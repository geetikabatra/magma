/**
 * Copyright 2020 The Magma Authors.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * @flow strict-local
 * @format
 */
import AppContext from '../../../app/components/context/AppContext';
import type {OrganizationPlainAttributes} from '../../../shared/sequelize_models/models/organization';

import Button from '@material-ui/core/Button';
import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import DialogTitle from '@material-ui/core/DialogTitle';
import LoadingFillerBackdrop from '../../components/LoadingFillerBackdrop';
import OrganizationInfoDialog from './OrganizationInfoDialog';
import OrganizationUserDialog from './OrganizationUserDialog';
import React from 'react';
import Tab from '@material-ui/core/Tab';
import Tabs from '@material-ui/core/Tabs';

import {UserRoles} from '../../../shared/roles';
import {colors} from '../../../app/theme/default';
import {makeStyles} from '@material-ui/styles';
import {useAxios} from '../../../app/hooks';
import {useContext, useEffect, useState} from 'react';

const useStyles = makeStyles(_ => ({
  tabBar: {
    backgroundColor: colors.primary.brightGray,
    color: colors.primary.white,
  },
  dialog: {
    backgroundColor: colors.primary.concrete,
  },
  dialogActions: {
    backgroundColor: colors.primary.white,
    padding: '20px',
    zIndex: '1',
  },
  dialogContent: {
    padding: '32px',
    minHeight: '480px',
  },
  dialogTitle: {
    backgroundColor: colors.primary.mirage,
    padding: '16px 24px',
    color: colors.primary.white,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
}));

export type DialogProps = {
  error: string,
  user: EditUser,
  organization: OrganizationPlainAttributes,
  onUserChange: EditUser => void,
  onOrganizationChange: OrganizationPlainAttributes => void,
  // Array of networks ids
  allNetworks: Array<string>,
  // If true, enable all networks for an organization
  shouldEnableAllNetworks: boolean,
  setShouldEnableAllNetworks: boolean => void,
  // flag to display advanced config fields in organization add/edit dialog
  hideAdvancedFields: boolean,
};

type Props = {
  onClose: () => void,
  onCreateOrg: (org: $Shape<OrganizationPlainAttributes>) => void,
  onCreateUser: (user: CreateUserType) => void,
  addingUserFor: ?Organization,
  user: ?EditUser,
  open: boolean,
  organization: ?OrganizationPlainAttributes,
  // flag to display advanced fields
  hideAdvancedFields: boolean,
  error: string,
};

type CreateUserType = {
  email: string,
  id?: number,
  networkIDs: Array<string>,
  organization?: string,
  role: ?string,
  password: ?string,
  passwordConfirmation?: string,
};

/**
 * Create Organization Dialog
 * This component displays a dialog with 2 tabs
 * First tab: OrganizationInfoDialog, to create a new organization
 * Second tab: OrganizationUserDialog, to create a user that belongs to the new organization
 */
export default function (props: Props) {
  const {ssoEnabled} = useContext(AppContext);
  const classes = useStyles();
  const {error, isLoading, response} = useAxios({
    method: 'get',
    url: '/host/networks/async',
  });

  const [organization, setOrganization] = useState<OrganizationPlainAttributes>(
    props.organization || {},
  );
  const [currentTab, setCurrentTab] = useState(0);
  const [shouldEnableAllNetworks, setShouldEnableAllNetworks] = useState(false);
  const [user, setUser] = useState<EditUser>(props.user || {});
  const [createError, setCreateError] = useState('');
  const allNetworks = error || !response ? [] : response.data.sort();

  useEffect(() => {
    setCurrentTab(props.addingUserFor?.id ? 1 : 0);
  }, [props.addingUserFor]);

  useEffect(() => {
    setOrganization(props.organization || {});
    setCreateError('');
    setUser(props.user || {});
  }, [props.open, props.organization, props.user]);

  if (isLoading) {
    return <LoadingFillerBackdrop />;
  }
  const createProps = {
    user,
    organization,
    error: createError,
    onUserChange: (user: EditUser) => {
      setUser(user);
    },
    onOrganizationChange: (organization: OrganizationPlainAttributes) => {
      setOrganization(organization);
    },
    allNetworks,
    shouldEnableAllNetworks,
    setShouldEnableAllNetworks,
    hideAdvancedFields: props.hideAdvancedFields,
  };
  const onSave = async () => {
    if (currentTab === 0) {
      if (!organization.name) {
        setCreateError('Name cannot be empty');
        return;
      }
      const newOrg = {
        id: organization.id,
        name: organization.name,
        networkIDs: shouldEnableAllNetworks
          ? allNetworks
          : Array.from(organization.networkIDs || []).sort(),
        customDomains: [], // TODO
        csvCharset: organization.csvCharset,
        ssoSelectedType: organization.ssoSelectedType,
        ssoCert: organization.ssoCert,
        ssoEntrypoint: organization.ssoEntrypoint,
        ssoIssuer: organization.ssoIssuer,
        ssoOidcClientID: organization.ssoOidcClientID,
        ssoOidcClientSecret: organization.ssoOidcClientSecret,
        ssoOidcConfigurationURL: organization.ssoOidcConfigurationURL,
      };
      props.onCreateOrg(newOrg);
      setCreateError('');
    } else {
      if (user.password != user.passwordConfirmation) {
        setCreateError('Passwords must match');
        return;
      }
      if (!user?.email) {
        setCreateError('Email cannot be empty');
        return;
      }

      if ((!user?.password ?? false) && !ssoEnabled && !user.id) {
        setCreateError('Password cannot be empty');
        return;
      }

      const newUser: CreateUserType = {
        email: user.email,
        password: user.password,
        role: user.role,
        networkIDs:
          user.role === UserRoles.SUPERUSER
            ? []
            : Array.from(user.networkIDs || []),
      };
      if ((user.id || ssoEnabled) && !user?.password) {
        delete newUser.password;
      }
      props.onCreateUser(newUser);
    }
  };

  return (
    <Dialog
      classes={{paper: classes.dialog}}
      open={props.open}
      onClose={props.onClose}
      maxWidth={'sm'}
      fullWidth={true}>
      <DialogTitle classes={{root: classes.dialogTitle}}>
        {currentTab === 0
          ? organization?.id
            ? 'Edit Organization'
            : 'Add Organization'
          : user?.id
          ? 'Edit User'
          : 'Add User'}
      </DialogTitle>
      <Tabs
        indicatorColor="primary"
        value={currentTab}
        classes={{root: classes.tabBar}}
        onChange={(_, v) => setCurrentTab(v)}>
        <Tab disabled={currentTab === 1} label={'Organization'} />
        <Tab disabled={currentTab === 0} label={'Users'} />
      </Tabs>
      <DialogContent classes={{root: classes.dialogContent}}>
        {currentTab === 0 && <OrganizationInfoDialog {...createProps} />}
        {currentTab === 1 && <OrganizationUserDialog {...createProps} />}
      </DialogContent>
      <DialogActions classes={{root: classes.dialogActions}}>
        <Button onClick={props.onClose}>Cancel</Button>
        <Button onClick={onSave} variant="contained" color="primary">
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/*
 Copyright 2020 The Magma Authors.

 This source code is licensed under the BSD-style license found in the
 LICENSE file in the root directory of this source tree.

 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.
*/

package swagger

import (
	"fmt"

	"github.com/golang/glog"

	"magma/orc8r/cloud/go/obsidian/swagger/spec"
	"magma/orc8r/cloud/go/parallel"
)

// GetCombinedSpec polls every servicer registered with
// a Swagger spec and merges them together to return a combined spec.
func GetCombinedSpec(yamlCommon string) (string, error) {
	servicers, err := GetSpecServicers()
	if err != nil {
		return "", err
	}

	var inps []parallel.In
	for _, s := range servicers {
		inps = append(inps, s)
	}

	yamlSpecs, err := parallel.MapInToString(inps, parallel.DefaultNumWorkers, func(in parallel.In) (parallel.Out, error) {
		s := in.(RemoteSpec)
		yamlSpec, err := s.GetPartialSpec()

		if err != nil {
			// Swallow error because the polling should continue
			// even if it fails to receive from a single servicer
			err = fmt.Errorf("get Swagger spec from %s service: %w", s.GetService(), err)
			glog.Error(err)
		}
		return yamlSpec, nil
	})
	if err != nil {
		return "", err
	}

	combined, warnings, err := spec.Combine(yamlCommon, yamlSpecs)
	if err != nil {
		return "", err
	}
	if warnings != nil {
		glog.Infof("Some Swagger spec traits were overwritten or unable to be read: %+v", warnings)
	}

	return combined, nil
}

// GetServiceSpec returns a service's standalone spec.
func GetServiceSpec(service string) (string, error) {
	remoteSpec := NewRemoteSpec(service)
	yamlSpec, err := remoteSpec.GetStandaloneSpec()
	if err != nil {
		return "", err
	}

	return yamlSpec, nil
}

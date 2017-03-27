import { createAction, handleActions } from 'redux-actions';
import 'fetch-everywhere';
import imm from 'object-path-immutable';
import Imm from 'immutable';

import {
  addLinksToState,
  removeResourceFromState,
  updateOrInsertResourcesIntoState,
  setIsInvalidatingForExistingResource,
  ensureResourceTypeInState
} from './state-mutation';
import { apiRequest } from './utils';
import {
  API_SET_AXIOS_CONFIG,
  API_WILL_CREATE,
  API_CREATED,
  API_CREATE_FAILED,
  API_WILL_READ,
  API_READ,
  API_READ_FAILED,
  API_WILL_UPDATE,
  API_UPDATED,
  API_UPDATE_FAILED,
  API_WILL_DELETE,
  API_DELETED,
  API_DELETE_FAILED,
} from './constants';

// Resource isInvalidating values
export const IS_DELETING = 'IS_DELETING';
export const IS_UPDATING = 'IS_UPDATING';

// Action creators
export const setAxiosConfig = createAction(API_SET_AXIOS_CONFIG);

const apiWillCreate = createAction(API_WILL_CREATE);
const apiCreated = createAction(API_CREATED);
const apiCreateFailed = createAction(API_CREATE_FAILED);

const apiWillRead = createAction(API_WILL_READ);
const apiRead = createAction(API_READ);
const apiReadFailed = createAction(API_READ_FAILED);

const apiWillUpdate = createAction(API_WILL_UPDATE);
const apiUpdated = createAction(API_UPDATED);
const apiUpdateFailed = createAction(API_UPDATE_FAILED);

const apiWillDelete = createAction(API_WILL_DELETE);
const apiDeleted = createAction(API_DELETED);
const apiDeleteFailed = createAction(API_DELETE_FAILED);

// Actions

export const createResource = (resource) => {
  return (dispatch, getState) => {
    dispatch(apiWillCreate(resource));

    const { axiosConfig } = getState().api.endpoint;
    const options = {
      ... axiosConfig,
      method: 'POST',
      data: {
        data: resource
      }
    };

    return new Promise((resolve, reject) => {
      apiRequest(resource.type, options)
        .then(json => {
          dispatch(apiCreated(json.data));
          resolve(json);
        }).catch(error => {
          const err = error;
          err.resource = resource;

          dispatch(apiCreateFailed(err));
          reject(err);
        });
    });
  };
};

export const readEndpoint = (endpoint, {
  options = {
    indexLinks: undefined,
  }
} = {}) => {
  return (dispatch, getState) => {
    dispatch(apiWillRead(endpoint));

    const { axiosConfig } = getState().api.endpoint;

    return new Promise((resolve, reject) => {
      apiRequest(endpoint, axiosConfig)
        .then(json => {
          dispatch(apiRead({ endpoint, options, ...json }));
          resolve(json);
        })
        .catch(error => {
          const err = error;
          err.endpoint = endpoint;

          dispatch(apiReadFailed(err));
          reject(err);
        });
    });
  };
};

export const updateResource = (resource) => {
  return (dispatch, getState) => {
    dispatch(apiWillUpdate(resource));

    const { axiosConfig } = getState().api.endpoint;
    const endpoint = `${resource.type}/${resource.id}`;

    const options = {
      ... axiosConfig,
      method: 'PATCH',
      data: {
        data: resource
      }
    };

    return new Promise((resolve, reject) => {
      apiRequest(endpoint, options)
        .then(json => {
          dispatch(apiUpdated(json.data));
          resolve(json);
        })
        .catch(error => {
          const err = error;
          err.resource = resource;

          dispatch(apiUpdateFailed(err));
          reject(err);
        });
    });
  };
};

export const deleteResource = (resource) => {
  return (dispatch, getState) => {
    dispatch(apiWillDelete(resource));

    const { axiosConfig } = getState().api.endpoint;
    const endpoint = `${resource.type}/${resource.id}`;

    const options = {
      ... axiosConfig,
      method: 'DELETE'
    };

    return new Promise((resolve, reject) => {
      apiRequest(endpoint, options)
        .then(() => {
          dispatch(apiDeleted(resource));
          resolve();
        })
        .catch(error => {
          const err = error;
          err.resource = resource;

          dispatch(apiDeleteFailed(err));
          reject(err);
        });
    });
  };
};

export const requireResource = (resourceType, endpoint = resourceType) => {
  return (dispatch, getState) => {
    return new Promise((resolve, reject) => {
      const { api } = getState();
      if (api.hasOwnProperty(resourceType)) {
        resolve();
      }

      dispatch(readEndpoint(endpoint))
        .then(resolve)
        .catch(reject);
    });
  };
};

export const createEntity = (...args) => {
  console.warn('createEntity is deprecated and will be removed in v2.0 in favor of new method createResource');
  return createResource(...args);
};

export const updateEntity = (...args) => {
  console.warn('updateEntity is deprecated and will be removed in v2.0 in favor of new method updateResource');
  return updateResource(...args);
};

export const deleteEntity = (...args) => {
  console.warn('deleteEntity is deprecated and will be removed in v2.0 in favor of new method deleteResource');
  return deleteResource(...args);
};

export const requireEntity = (...args) => {
  console.warn('requireEntity is deprecated and will be removed in v2.0 in favor of new method requireResource');
  return requireResource(...args);
};

// Reducers
export const reducer = handleActions({

  [API_SET_AXIOS_CONFIG]: (state, { payload: axiosConfig }) => {
    return Imm.fromJS(state).setIn(['endpoint', 'axiosConfig'], axiosConfig).toJS();
  },

  [API_WILL_CREATE]: (state) => {
    return imm(state).set(['isCreating'], state.isCreating + 1).value();
  },

  [API_CREATED]: (state, { payload: resources }) => {
    const entities = Array.isArray(resources.data) ? resources.data : [resources.data];

    const newState = updateOrInsertResourcesIntoState(
      state,
      entities.concat(resources.included || [])
    );

    return imm(newState)
      .set('isCreating', state.isCreating - 1)
      .value();
  },

  [API_CREATE_FAILED]: (state) => {
    return imm(state).set(['isCreating'], state.isCreating - 1).value();
  },

  [API_WILL_READ]: (state) => {
    return imm(state).set(['isReading'], state.isReading + 1).value();
  },

  [API_READ]: (state, { payload }) => {
    const resources = (
      Array.isArray(payload.data)
      ? payload.data
      : [payload.data]
    ).concat(payload.included || []);

    const newState = updateOrInsertResourcesIntoState(state, resources);
    const finalState = addLinksToState(newState, payload.links, payload.options);

    return imm(finalState)
      .set('isReading', state.isReading - 1)
      .value();
  },

  [API_READ_FAILED]: (state) => {
    return imm(state).set(['isReading'], state.isReading - 1).value();
  },

  [API_WILL_UPDATE]: (state, { payload: resource }) => {
    const { type, id } = resource;

    const newState = ensureResourceTypeInState(state, type);

    return setIsInvalidatingForExistingResource(newState, { type, id }, IS_UPDATING)
      .set('isUpdating', state.isUpdating + 1)
      .value();
  },

  [API_UPDATED]: (state, { payload: resources }) => {
    const entities = Array.isArray(resources.data) ? resources.data : [resources.data];

    const newState = updateOrInsertResourcesIntoState(
      state,
      entities.concat(resources.included || [])
    );

    return imm(newState)
      .set('isUpdating', state.isUpdating - 1)
      .value();
  },

  [API_UPDATE_FAILED]: (state, { payload: { resource } }) => {
    const { type, id } = resource;

    return setIsInvalidatingForExistingResource(state, { type, id }, IS_UPDATING)
      .set('isUpdating', state.isUpdating + 1)
      .value();
  },

  [API_WILL_DELETE]: (state, { payload: resource }) => {
    const { type, id } = resource;

    return setIsInvalidatingForExistingResource(state, { type, id }, IS_DELETING)
      .set('isDeleting', state.isDeleting + 1)
      .value();
  },

  [API_DELETED]: (state, { payload: resource }) => {
    return removeResourceFromState(state, resource)
      .set('isDeleting', state.isDeleting - 1)
      .value();
  },

  [API_DELETE_FAILED]: (state, { payload: { resource } }) => {
    const { type, id } = resource;

    return setIsInvalidatingForExistingResource(state, { type, id }, IS_DELETING)
      .set('isDeleting', state.isDeleting + 1)
      .value();
  }

}, {
  isCreating: 0,
  isReading: 0,
  isUpdating: 0,
  isDeleting: 0,
  endpoint: {
    axiosConfig: {}
  }
});

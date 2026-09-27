import {
  clearSelectedInstance,
  loadSelectedInstance,
  saveSelectedInstance,
  SELECTED_INSTANCE_STORAGE_KEY,
} from './selectedInstanceStorage';

const credentials = {
  idInstance: '1101000001',
  apiTokenInstance: 'test-token',
};

describe('selectedInstanceStorage', () => {
  it('stores and restores credentials under selectedInstance', () => {
    saveSelectedInstance(credentials);

    expect(window.localStorage.getItem(SELECTED_INSTANCE_STORAGE_KEY)).toBe(
      JSON.stringify(credentials),
    );
    expect(loadSelectedInstance()).toEqual(credentials);
  });

  it('removes stored credentials', () => {
    saveSelectedInstance(credentials);

    clearSelectedInstance();

    expect(window.localStorage.getItem(SELECTED_INSTANCE_STORAGE_KEY)).toBeNull();
  });

  it('removes an invalid stored value', () => {
    window.localStorage.setItem(
      SELECTED_INSTANCE_STORAGE_KEY,
      JSON.stringify({ idInstance: 'invalid', apiTokenInstance: '' }),
    );

    expect(loadSelectedInstance()).toBeNull();
    expect(window.localStorage.getItem(SELECTED_INSTANCE_STORAGE_KEY)).toBeNull();
  });
});

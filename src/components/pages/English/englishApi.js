import axiosInstance from '../../../axiosConfig';

// `list` is one of cards / sentences / texts / writings (the API's "kind").
const itemPath = (list, id) => `/api/English/items/${list}/${encodeURIComponent(id)}`;

export const fetchItemsAsync = async () => (await axiosInstance.get('/api/English/items')).data;

export const saveItemAsync = (list, item) => axiosInstance.put(itemPath(list, item.id), item);

export const saveItemsAsync = (itemsByList) => axiosInstance.post('/api/English/items/bulk', itemsByList);

// Already gone on the server (e.g. never synced) counts as deleted.
export const deleteItemAsync = async (list, id) => {
  try {
    await axiosInstance.delete(itemPath(list, id));
  } catch (err) {
    if (err.response?.status !== 404) throw err;
  }
};

// Creates today's lesson on the server unless it exists; { created, ... }.
export const createDailyAsync = async (date) => (await axiosInstance.post('/api/English/daily', { date })).data;

export const checkTextAsync = async (text) => (await axiosInstance.post('/api/English/check', { text })).data;

export const syncErrorMessage = (err) => {
  const status = err.response?.status;
  if (status === 401) return 'log in to sync — changes stay in this browser only';
  if (status === 429) return 'too many requests — wait a minute';
  return err.response?.data?.error?.message || 'could not reach the server — changes stay in this browser only';
};

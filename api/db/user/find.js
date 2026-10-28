import { handleDataApi } from '../../dataHandler.js';

export default async function handler(req, res) {
  return handleDataApi(req, res, 'user_find');
}

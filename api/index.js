const { app } = require('../backend/server');
const { initDB } = require('../backend/src/config/db');

let databaseReady;

module.exports = async function handler(req, res) {
  try {
    databaseReady ||= initDB().catch(error => {
      databaseReady = undefined;
      throw error;
    });
    await databaseReady;

    const requestUrl = new URL(req.url, 'http://localhost');
    const rewrittenPath = requestUrl.searchParams.get('__path');
    if (rewrittenPath !== null) {
      requestUrl.searchParams.delete('__path');
      const query = requestUrl.searchParams.toString();
      const apiPath = rewrittenPath ? `/api/${rewrittenPath}` : '/';
      req.url = `${apiPath}${query ? `?${query}` : ''}`;
    }
    return app(req, res);
  } catch (error) {
    console.error(`Vercel request initialization failed: ${error.message}`);
    return res.status(500).json({
      code: 'SERVICE_UNAVAILABLE',
      message: 'Layanan belum siap. Silakan coba lagi.',
    });
  }
};

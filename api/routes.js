const initializeRoutes = (app) => {
    app.get('/health-check', (req, res) => {
        return res.status(200).end();
    });
  
    // Bot Webhook
    app.post('/webhook', (req, res) => {
    // const body = req.body();
        return res.status(204).end();
    });
    return app;
};

module.exports = {
    initializeRoutes,
};

function logger(req, res, next) {
  const start = Date.now();
  const timestamp = new Date().toISOString();

  res.on("finish", () => {
    const method = req.method;
    const url = req.originalUrl;
    const status = res.statusCode;
    const responseTime = Date.now() - start;

    let log = `[${timestamp}] ${method} ${url} ${status} - ${responseTime}ms`;

    const bodyMethods = ["POST", "PUT", "PATCH"];
    if (bodyMethods.includes(method) && req.body && Object.keys(req.body).length > 0) {
      log += ` ${JSON.stringify(maskSensitiveFields(req.body))}`;
    }

    console.log(log);
  });

  next();
}

function maskSensitiveFields(data) {
  const masked = { ...data };
  for (const key of Object.keys(masked)) {
    if (key.toLowerCase().includes("password")) {
      masked[key] = "***";
    }
  }
  return masked;
}

module.exports = logger;
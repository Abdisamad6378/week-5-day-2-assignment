const express = require("express");
const logger = require("./middleware/logger");

const app = express();

app.use(express.json());
app.use(logger);

app.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});
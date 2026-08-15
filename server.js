const express = require("express");
const logger = require("./middleware/logger");
const auth = require("./middleware/auth");
const { AppError, errorHandler } = require("./middleware/errorHandler");

const app = express();

const cities = [
  { id: 1, name: "Nairobi", county: "Nairobi" },
  { id: 2, name: "Mombasa", county: "Mombasa" },
];

app.use(express.json());
app.use(logger);

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

app.get("/api/cities", (req, res) => {
  res.json({ success: true, data: cities });
});

app.get("/api/cities/:id", (req, res) => {
  const city = cities.find((c) => c.id === parseInt(req.params.id));
  if (!city) throw new AppError("City not found", 404);
  res.json({ success: true, data: city });
});

app.post("/api/cities", auth, (req, res) => {
  const { name, county } = req.body;
  const newCity = { id: cities.length + 1, name, county };
  cities.push(newCity);
  res.status(201).json({ success: true, data: newCity });
});

app.delete("/api/cities/:id", auth, (req, res) => {
  const id = parseInt(req.params.id);
  const index = cities.findIndex((city) => city.id === id);
  if (index === -1) throw new AppError("City not found", 404);
  const [removed] = cities.splice(index, 1);
  res.json({ success: true, data: removed });
});

app.use((req, res, next) => {
  next(new Error("Something went wrong"));
});

app.use(errorHandler);

app.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});
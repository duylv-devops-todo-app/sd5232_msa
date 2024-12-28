const express = require("express");
const serverResponses = require("../utils/helpers/responses");
const messages = require("../config/messages");
const { Todo } = require("../models/todos/todo");
const client = require("prom-client");
const { startTime } = require("pino-http");

const register = client.register;
const collectDefaultMetrics = client.collectDefaultMetrics;
collectDefaultMetrics();

// Custom metrics
const todoCounter = new client.Counter({
  name: "todos_created_total",
  help: "Total number of todos created",
});

const errorCounter = new client.Counter({
  name: "todos_error_total",
  help: "Total number of errors during todo operations",
});

const activeTodosGauge = new client.Gauge({
  name: "active_todos",
  help: "Current number of active todos",
});

const todosFetchedHistogram = new client.Histogram({
  name: "todos_fetch_duration_seconds",
  help: "Duration of fetching todos",
  buckets: [0.1, 0.5, 1, 2, 5], // Buckets for request duration in seconds
});

const requestCounter = new client.Counter({
  name: "http_requests_total",
  help: "Total number of HTTP requests",
  labelNames: ["method", "route", "status_code"],
});

const errorRateSummary = new client.Summary({
  name: "error_rate_summary",
  help: "Summary of error latency and rates",
  percentiles: [0.5, 0.9, 0.99],
});

// Koa-style HTTP metrics (Optional for enhanced metrics)
const httpMetricsLabelNames = ['method', 'path'];
const totalHttpRequestCount = new client.Counter({
  name: 'nodejs_http_total_count',
  help: 'Total number of HTTP requests',
  labelNames: httpMetricsLabelNames
});

const totalHttpRequestDuration = new client.Gauge({
  name: 'nodejs_http_total_duration',
  help: 'Duration of the last HTTP request',
  labelNames: httpMetricsLabelNames
});

// Express setup
const app = express();
const router = express.Router();

// Middleware to count requests and collect detailed metrics
router.use((req, res, next) => {
  const startTime = Date.now();
  res.on("finish", () => {
    const duration = (Date.now() - startTime) / 1000; // Convert to seconds
    requestCounter.inc({ method: req.method, route: req.route?.path || "unknown", status_code: res.statusCode });
    if (res.statusCode >= 400) {
      errorRateSummary.observe(duration);
    }
    totalHttpRequestCount.labels(req.method, req.route?.path || "unknown").inc();
    totalHttpRequestDuration.labels(req.method, req.route?.path || "unknown").inc(duration * 1000);
  });
  next();
});

// Metrics route
router.get("/metrics", async (req, res) => {
  try {
    res.set("Content-Type", register.contentType);
    res.end(await register.metrics());
  } catch (e) {
    res.status(500).send("Error fetching metrics");
  }
});

// Create a new todo
router.post("/todos", (req, res) => {
  const todo = new Todo({
    text: req.body.text,
  });

  todo
    .save()
    .then((result) => {
      todoCounter.inc();
      activeTodosGauge.inc(); // Increment active todos gauge
      serverResponses.sendSuccess(res, messages.SUCCESSFUL, result);
    })
    .catch((e) => {
      errorCounter.inc();
      errorRateSummary.observe(1); // Observe latency for error
      serverResponses.sendError(res, messages.BAD_REQUEST, e);
    });
});

// Get all todos
router.get("/", (req, res) => {
  const startTime = Date.now(); // Start time for histogram
  Todo.find({}, { __v: 0 })
    .then((todos) => {
      const duration = (Date.now() - startTime) / 1000;
      todosFetchedHistogram.observe(duration); // Record fetch duration
      serverResponses.sendSuccess(res, messages.SUCCESSFUL, todos);
    })
    .catch((e) => {
      errorCounter.inc();
      errorRateSummary.observe(1); // Observe latency for error
      serverResponses.sendError(res, messages.BAD_REQUEST, e);
    });
});

// Delete a todo (new route)
router.delete("/todos/:id", (req, res) => {
  Todo.findByIdAndDelete(req.params.id)
    .then((result) => {
      if (result) {
        activeTodosGauge.dec(); // Decrement active todos gauge
        serverResponses.sendSuccess(res, messages.SUCCESSFUL, result);
      } else {
        errorCounter.inc();
        serverResponses.sendError(res, messages.NOT_FOUND, "Todo not found");
      }
    })
    .catch((e) => {
      errorCounter.inc();
      serverResponses.sendError(res, messages.BAD_REQUEST, e);
    });
});

// Use API prefix
app.use("/api", router);

// Start the server
app.listen(3000, () => {
  console.log("Server is running on http://localhost:3000");
});

module.exports = app;
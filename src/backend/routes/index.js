const express = require("express");
const serverResponses = require("../utils/helpers/responses");
const messages = require("../config/messages");
const { Todo } = require("../models/todos/todo");
const Prometheus = require("prom-client");

const routes = (app) => {
  const router = express.Router();

  // Default Prometheus metrics
  const collectDefaultMetrics = Prometheus.collectDefaultMetrics;
  collectDefaultMetrics({
    labels: { NODE_APP_INSTANCE: "backend" },
  });

  // Custom metrics
  const postRequestCounter = new Prometheus.Counter({
    name: "number_of_post_request_hit",
    help: "Tracks the number of POST requests made to /todos",
  });

  const requestDurationHistogram = new Prometheus.Histogram({
    name: "http_request_duration_seconds",
    help: "Duration of HTTP requests in seconds",
    labelNames: ["method", "route", "status_code"],
    buckets: [0.1, 0.5, 1, 3, 5],
  });

  const activeConnectionsGauge = new Prometheus.Gauge({
    name: "active_http_connections",
    help: "Number of active HTTP connections",
  });

  // Middleware to track active connections
  app.use((req, res, next) => {
    activeConnectionsGauge.inc();
    res.on("finish", () => activeConnectionsGauge.dec());
    next();
  });

  // POST /todos
  router.post("/todos", (req, res) => {
    const start = Date.now();
    const todo = new Todo({
      text: req.body.text,
    });

    // Increment POST request counter
    postRequestCounter.inc();

    todo
      .save()
      .then((result) => {
        // Record request duration
        const duration = (Date.now() - start) / 1000; // Convert to seconds
        requestDurationHistogram.labels("POST", "/todos", "200").observe(duration);

        serverResponses.sendSuccess(res, messages.SUCCESSFUL, result);
      })
      .catch((e) => {
        const duration = (Date.now() - start) / 1000;
        requestDurationHistogram.labels("POST", "/todos", "400").observe(duration);

        serverResponses.sendError(res, messages.BAD_REQUEST, e);
      });
  });

  // GET /
  router.get("/", (req, res) => {
    const start = Date.now();

    Todo.find({}, { __v: 0 })
      .then((todos) => {
        const duration = (Date.now() - start) / 1000;
        requestDurationHistogram.labels("GET", "/", "200").observe(duration);

        serverResponses.sendSuccess(res, messages.SUCCESSFUL, todos);
      })
      .catch((e) => {
        const duration = (Date.now() - start) / 1000;
        requestDurationHistogram.labels("GET", "/", "400").observe(duration);

        serverResponses.sendError(res, messages.BAD_REQUEST, e);
      });
  });

  // Prometheus metrics endpoint
  router.get("/metrics", (req, res) => {
    res.setHeader("Content-Type", Prometheus.register.contentType);
    Prometheus.register.metrics().then((data) => {
      res.end(data);
    });
  });

  // Environment endpoint
  router.get("/environment", (req, res) => {
    console.log("Hello world");
    console.log(process.env);
    res.send(process.env.CURRENT_ENV);
  });

  // Apply routes with prefix
  app.use("/api", router);
};

module.exports = routes;

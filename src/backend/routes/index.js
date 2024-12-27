const express = require("express");
const serverResponses = require("../utils/helpers/responses");
const messages = require("../config/messages");
const { Todo } = require("../models/todos/todo");
const client = require("prom-client");

const register = client.register;

const collectDefaultMetrics = client.collectDefaultMetrics;
collectDefaultMetrics();

const todoCounter = new client.Counter({
  name: "todos_created_total",
  help: "Total number of todos created",
});

const errorCounter = new client.Counter({
  name: "todos_error_total",
  help: "Total number of errors during todo operations",
});

const routes = (app) => {
  const router = express.Router();

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
        serverResponses.sendSuccess(res, messages.SUCCESSFUL, result);
      })
      .catch((e) => {
        errorCounter.inc();
        serverResponses.sendError(res, messages.BAD_REQUEST, e);
      });
  });

  // Get all todos
  router.get("/", (req, res) => {
    Todo.find({}, { __v: 0 })
      .then((todos) => {
        serverResponses.sendSuccess(res, messages.SUCCESSFUL, todos);
      })
      .catch((e) => {
        errorCounter.inc(); // Increment error counter on failure
        serverResponses.sendError(res, messages.BAD_REQUEST, e);
      });
  });

  // Use API prefix
  app.use("/api", router);
};

module.exports = routes;
// Import the necessary functions from 'express'
const { Request, Response, NextFunction } = require('express');

// The higher-order function
const catchAsync = (execution) => (req, res, next) => {
  execution(req, res, next).catch(next);
};

// Exporting the function
module.exports = catchAsync;

import Joi from "joi";
import { ParsedQs } from "qs";
import { Request, Response, NextFunction } from "express";

type Validator = Joi.ObjectSchema;

const _validate = async (
  data: unknown,
  validator: Validator
): Promise<unknown> => {
  try {
    const validated = await validator.validateAsync(data, { abortEarly: false });
    return validated;
  } catch (err: unknown) {
    if (err instanceof Joi.ValidationError) {
      const errors: Record<string, string[]> = {};
      err.details.forEach((detail) => {
        const key = detail.path.join(".");
        if (!errors[key]) {
          errors[key] = [];
        }
        errors[key].push(detail.message);
      });

      throw { status: 400, message: "Validation failed", error: errors };
    }

    throw {
      status: 500,
      message: "Internal server error",
      error: err instanceof Error ? err.message : err,
    };
  }
};

export const bodyValidator = (validator: Validator) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      req.body = await _validate(req.body, validator);
      next();
    } catch (error: unknown) {
      const status =
        typeof error === "object" && error && "status" in error
          ? (error as any).status
          : 500;
      const message =
        typeof error === "object" && error && "message" in error
          ? (error as any).message
          : "Unexpected error";
      const err =
        typeof error === "object" && error && "error" in error
          ? (error as any).error
          : error;

      return res.status(status).json({
        message,
        response: null,
        error: err,
      });
    }
  };
};

export const queryValidator = (validator: Validator) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (req.query.email && typeof req.query.email === "string") {
        req.query.email = req.query.email.replace(/ /g, "+");
      }
      if (req.query.old_email && typeof req.query.old_email === "string") {
        req.query.old_email = req.query.old_email.replace(/ /g, "+");
      }
      req.query = (await _validate(req.query, validator)) as ParsedQs;
      next();
    } catch (error: unknown) {
      const status =
        typeof error === "object" && error && "status" in error
          ? (error as any).status
          : 500;
      const message =
        typeof error === "object" && error && "message" in error
          ? (error as any).message
          : "Unexpected error";
      const err =
        typeof error === "object" && error && "error" in error
          ? (error as any).error
          : error;

      return res.status(status).json({
        message,
        response: null,
        error: err,
      });
    }
  };
};

export const paramsValidator = (validator: Validator) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      req.params = (await _validate(req.params, validator)) as typeof req.params;
      next();
    } catch (error: unknown) {
      const status =
        typeof error === "object" && error && "status" in error
          ? (error as any).status
          : 500;
      const message =
        typeof error === "object" && error && "message" in error
          ? (error as any).message
          : "Unexpected error";
      const err =
        typeof error === "object" && error && "error" in error
          ? (error as any).error
          : error;

      return res.status(status).json({
        message,
        response: null,
        error: err,
      });
    }
  };
};















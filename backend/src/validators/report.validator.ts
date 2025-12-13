import Joi from "joi";

export const getReportQuerySchema = Joi.object({
  startDate: Joi.string()
    .optional()
    .isoDate()
    .messages({
      "string.isoDate": "Start date must be a valid ISO date",
    }),
  endDate: Joi.string()
    .optional()
    .isoDate()
    .messages({
      "string.isoDate": "End date must be a valid ISO date",
    }),
});



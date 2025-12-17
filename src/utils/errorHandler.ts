import { AxiosError } from "axios";
import { AlertType } from "../components/ui/Alert";

export interface ValidationError {
  [field: string]: string[];
}

export interface ApiErrorResponse {
  message?: string;
  response?: null;
  error?: string | ValidationError;
}

export function extractErrorMessage(error: unknown): string {
  if (error instanceof AxiosError) {
    const response = error.response?.data as ApiErrorResponse | undefined;
    if (response?.message) {
      return response.message;
    }
    if (response?.error) {
      if (typeof response.error === "string") {
        return response.error;
      }
      // If it's a validation error object, get the first error message
      const validationErrors = response.error as ValidationError;
      const firstField = Object.keys(validationErrors)[0];
      if (firstField && validationErrors[firstField]?.length > 0) {
        return validationErrors[firstField][0];
      }
    }
    if (error.message) {
      return error.message;
    }
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "An unexpected error occurred";
}

export function extractValidationErrors(error: unknown): ValidationError | null {
  if (error instanceof AxiosError) {
    const response = error.response?.data as ApiErrorResponse | undefined;
    if (response?.error && typeof response.error === "object" && !Array.isArray(response.error)) {
      return response.error as ValidationError;
    }
  }
  return null;
}

export function getErrorType(error: unknown): AlertType {
  if (error instanceof AxiosError) {
    const status = error.response?.status;
    if (status === 400 || status === 422) {
      return "error";
    }
    if (status === 401 || status === 403) {
      return "warning";
    }
    if (status === 404) {
      return "info";
    }
  }
  return "error";
}







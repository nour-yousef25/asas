import { NextResponse } from "next/server";
import { ZodError } from "zod";

export type ApiResponse<T> = {
  success: boolean;
  data?: T;
  error?: string;
};

export function Success<T>(data: T): ApiResponse<T> {
  return { success: true, data };
}

export function apiSuccess<T>(data: T, status = 200) {
  return NextResponse.json(Success(data), { status });
}

export function apiError(message: string, status = 400) {
  return NextResponse.json(InvalidRequest(message), { status });
}

export function apiUnauthorized(message = "غير مصرح") {
  return apiError(message, 401);
}

export function apiInternalError(message = "حدث خطأ داخلي") {
  return apiError(message, 500);
}

export function InvalidRequest(message: string): ApiResponse<never> {
  return { success: false, error: message };
}

export function handleApiError(error: unknown): NextResponse {
  if (error instanceof ZodError) {
    return NextResponse.json(InvalidRequest(error.issues[0]?.message ?? "بيانات الطلب غير صالحة"), { status: 400 });
  }
  if (error instanceof Error) {
    return NextResponse.json(InvalidRequest(error.message), { status: 400 });
  }
  return NextResponse.json(InvalidRequest("خطأ غير متوقع"), { status: 500 });
}

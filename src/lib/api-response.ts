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

export function InvalidRequest(message: string): ApiResponse<never> {
  return { success: false, error: message };
}

export function handleApiError(error: unknown): NextResponse {
  if (error instanceof ZodError) {
    return NextResponse.json(InvalidRequest(error.errors[0].message), { status: 400 });
  }
  if (error instanceof Error) {
    return NextResponse.json(InvalidRequest(error.message), { status: 400 });
  }
  return NextResponse.json(InvalidRequest("خطأ غير متوقع"), { status: 500 });
}

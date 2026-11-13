from fastapi import Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

STATUS = {
    "BUILD_FAILED": 500,
    "ORACLE_TIMEOUT": 504,
    "RUNTIME_ERROR": 500,
    "BAD_REQUEST": 400,
    "NOT_FOUND": 404,
}


class ApiError(Exception):
    def __init__(self, code, message, detail=None, status=None):
        super().__init__(message)
        self.code = code
        self.message = message
        self.detail = detail if detail is not None else {}
        self.status = status or STATUS.get(code, 500)


def body(code, message, detail=None):
    return {"error": {"code": code, "message": message, "detail": detail if detail is not None else {}}}


def install(app):
    @app.exception_handler(ApiError)
    async def api_error(request: Request, exc: ApiError):
        return JSONResponse(body(exc.code, exc.message, exc.detail), status_code=exc.status)

    @app.exception_handler(RequestValidationError)
    async def invalid(request: Request, exc: RequestValidationError):
        problems = [
            {"field": ".".join(str(p) for p in e.get("loc", ())[1:]), "problem": e.get("msg", "")}
            for e in exc.errors()
        ]
        return JSONResponse(body("BAD_REQUEST", "request body is not valid", {"problems": problems}), status_code=400)

    @app.exception_handler(StarletteHTTPException)
    async def http_error(request: Request, exc: StarletteHTTPException):
        if exc.status_code == 404:
            return JSONResponse(body("NOT_FOUND", "not found"), status_code=404)
        if exc.status_code == 405:
            return JSONResponse(body("BAD_REQUEST", "method not allowed"), status_code=405)
        return JSONResponse(body("RUNTIME_ERROR", str(exc.detail)), status_code=exc.status_code)

    @app.exception_handler(Exception)
    async def unexpected(request: Request, exc: Exception):
        return JSONResponse(body("RUNTIME_ERROR", "unexpected server error", {"type": type(exc).__name__}), status_code=500)

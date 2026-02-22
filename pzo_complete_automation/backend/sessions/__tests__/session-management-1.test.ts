import { SessionManagement } from "../session-management";
import { Request, Response, NextFunction } from "express";
import { createMockContext } from "@jest-mock/express";

describe("Session Management", () => {
const sessionManagement = new SessionManagement();

beforeEach(() => {
jest.clearAllMocks();
});

test("It should start a new session", () => {
const req = createMockContext<Request>({}).req;
const res = createMockContext<Response>().res;
const next = createMockContext<NextFunction>().next;

sessionManagement.startSession(req, res, next);

expect(res.cookie).toHaveBeenCalledWith("sessionId", expect.any(String));
});

test("It should extend the existing session", () => {
const req = createMockContext<Request>({}).req;
const res = createMockContext<Response>().res;
const next = createMockContext<NextFunction>().next;

req.cookies["sessionId"] = "testSession";

sessionManagement.extendSession(req, res, next);

expect(res.cookie).toHaveBeenCalledWith("sessionId", "testSession");
});

test("It should handle invalid sessions and create a new one", () => {
const req = createMockContext<Request>({}).req;
const res = createMockContext<Response>().res;
const next = createMockContext<NextFunction>().next;

req.cookies["sessionId"] = "invalidSession";

sessionManagement.startOrExtendSession(req, res, next);

expect(res.cookie).toHaveBeenCalledWith("sessionId", expect.any(String));
});

test("It should destroy the session", () => {
const req = createMockContext<Request>({}).req;
const res = createMockContext<Response>().res;
const next = createMockContext<NextFunction>().next;

req.cookies["sessionId"] = "testSession";

sessionManagement.destroySession(req, res, next);

expect(res.clearCookie).toHaveBeenCalledWith("sessionId");
});
});

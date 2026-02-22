import { SessionManager } from "../session-management";
import { Request, Response, NextFunction } from "express";

describe("Session Management", () => {
const sessionManager = new SessionManager();

beforeEach(() => {
// Reset session manager for each test
sessionManager.sessions = {};
});

it("should create a new session", () => {
const req: Request = {} as any;
const res: Response = {} as any;
const next: NextFunction = jest.fn();

sessionManager.createSession(req, res);

expect(res.cookie).toHaveProperty("connect.sid", expect.any(String));
});

it("should access the session by id", () => {
const req: Request = { session: { id: "test_session_id" } } as any;
const res: Response = {} as any;
const next: NextFunction = jest.fn();

const sessionData = { user: "test_user" };
sessionManager.sessions["test_session_id"] = sessionData;

sessionManager.accessSession(req, res, next);

expect(res.locals.session).toEqual(sessionData);
});

it("should destroy a session", () => {
const req: Request = { session: { id: "test_session_id" } } as any;
const res: Response = {} as any;
const next: NextFunction = jest.fn();

sessionManager.destroySession(req, res);

expect(res).toHaveProperty("clearCookie", expect.any(Function));
expect(sessionManager.sessions["test_session_id"]).toBeUndefined();
});
});

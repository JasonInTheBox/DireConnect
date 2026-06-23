import type { Request, Response, NextFunction } from "express";
import { supabase } from "../lib/supabase.js";

export interface AuthenticatedRequest extends Request {
    user?: {
        id: string; 
        email?: string | undefined;
    };
}

export async function requireAuth(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
) {
    const authHeader = req.headers.authorization;

    if(!authHeader?.startsWith("Bearer ")) {
        return res.status(401).json({error: "Missing authorization token"});
    }

    const token = authHeader.split(" ")[1];

    const {
        data : { user },
        error,
    } = await supabase.auth.getUser(token);

    if (error || !user) {
        return res.status(401).json({ error: "Invalid or expired token" });
    }

    req.user = {
        id: user.id,
        email: user.email,
    };

    next();
}

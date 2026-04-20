import { Router, type IRouter, type Request, type Response } from "express";
import { getSessionProfile } from "../lib/auth";
import { toProfile } from "../lib/shapes";

const router: IRouter = Router();

router.get("/me", async (req: Request, res: Response) => {
  const profile = await getSessionProfile(req);
  if (!profile) {
    res.json({ authenticated: false });
    return;
  }
  res.json({ authenticated: true, profile: toProfile(profile) });
});

export default router;

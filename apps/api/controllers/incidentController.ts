import type { Request, Response } from "express";
import { Incident, Website } from "db/client";
import { isValidId } from "../utils/websites";
import { monitorDisplayName, serializeIncident, type MonitorRefLike } from "../utils/incidents";
import { sendCsv, toCsv } from "../utils/csv";
import { incidentUpdateSchema, parseBody } from "../validation";
import { parseBefore, parseLimit } from "./websiteController";

const MAX_PAGE = 200;
const MAX_UPDATES_PER_INCIDENT = 100;
const MAX_EXPORT_ROWS = 10_000;
const INCIDENT_STATUSES = ["open", "acknowledged", "resolved", "all"] as const;
const MONITOR_FIELDS = "name url type host port";

/** Load the monitors referenced by incidents, keyed by id (deleted ones included). */
export async function monitorsFor(incidents: { websiteId: unknown }[]): Promise<Map<string, MonitorRefLike>> {
  const ids = [...new Set(incidents.map((i) => String(i.websiteId)))];
  if (ids.length === 0) return new Map();
  const websites = await Website.find({ _id: { $in: ids } }).select(MONITOR_FIELDS).lean();
  return new Map(websites.map((w: any) => [String(w._id), w]));
}

/** Serialize incidents as `IncidentDetail`s with their monitor's name and URL. */
export async function serializeIncidents(incidents: any[]) {
  const monitors = await monitorsFor(incidents);
  return incidents.map((i) => serializeIncident(i, monitors.get(String(i.websiteId))));
}

async function serializeOne(incident: any) {
  const [detail] = await serializeIncidents([incident]);
  return detail;
}

// GET /incidents?status=&websiteId=&limit=&before=
export const listIncidents = async (req: Request, res: Response) => {
  const userId = req.userId!;
  const status = (req.query.status ?? "all") as string;
  if (!(INCIDENT_STATUSES as readonly string[]).includes(status)) {
    res.status(400).json({ message: `status must be one of ${INCIDENT_STATUSES.join(", ")}.` });
    return;
  }
  const websiteId = req.query.websiteId;
  if (websiteId !== undefined && websiteId !== "" && !isValidId(websiteId)) {
    res.status(400).json({ message: "Invalid websiteId." });
    return;
  }
  const before = parseBefore(req.query.before);
  if (before === null) {
    res.status(400).json({ message: "before must be an ISO date." });
    return;
  }
  const limit = parseLimit(req.query.limit, 50, MAX_PAGE);

  const filter: Record<string, unknown> = { userId };
  if (websiteId) filter.websiteId = websiteId;
  if (before) filter.startedAt = { $lt: before };
  if (status === "open") Object.assign(filter, { ongoing: true, acknowledgedAt: null });
  else if (status === "acknowledged") Object.assign(filter, { ongoing: true, acknowledgedAt: { $ne: null } });
  else if (status === "resolved") filter.ongoing = false;

  const incidents = await Incident.find(filter).sort({ startedAt: -1 }).limit(limit).lean();
  const last = incidents[incidents.length - 1];
  res.json({
    incidents: await serializeIncidents(incidents),
    nextBefore: incidents.length === limit && last ? new Date(last.startedAt).toISOString() : null,
  });
};

/** Respond 400 for a malformed id; returns whether it's usable. */
function checkId(id: unknown, res: Response): id is string {
  if (isValidId(id)) return true;
  res.status(400).json({ error: "Invalid incident id." });
  return false;
}

const notFound = (res: Response) => res.status(404).json({ error: "Incident not found." });

// GET /incidents/:incidentId
export const getIncident = async (req: Request, res: Response) => {
  const id = req.params.incidentId;
  if (!checkId(id, res)) return;
  const incident = await Incident.findOne({ _id: id, userId: req.userId! }).lean();
  if (!incident) {
    notFound(res);
    return;
  }
  res.json(await serializeOne(incident));
};

// POST /incidents/:incidentId/acknowledge (idempotent)
export const acknowledgeIncident = async (req: Request, res: Response) => {
  const id = req.params.incidentId;
  if (!checkId(id, res)) return;
  const userId = req.userId!;

  // Only the first acknowledgement sets the time.
  const incident =
    (await Incident.findOneAndUpdate(
      { _id: id, userId, acknowledgedAt: null },
      { $set: { acknowledgedAt: new Date() } },
      { new: true }
    ).lean()) ?? (await Incident.findOne({ _id: id, userId }).lean());
  if (!incident) {
    notFound(res);
    return;
  }
  res.json(await serializeOne(incident));
};

// POST /incidents/:incidentId/updates
export const addIncidentUpdate = async (req: Request, res: Response) => {
  const id = req.params.incidentId;
  if (!checkId(id, res)) return;
  const userId = req.userId!;
  const body = parseBody(incidentUpdateSchema, req, res);
  if (!body) return;

  const incident = await Incident.findOneAndUpdate(
    { _id: id, userId, [`updates.${MAX_UPDATES_PER_INCIDENT - 1}`]: { $exists: false } },
    { $push: { updates: { at: new Date(), message: body.message, status: body.status, public: body.public } } },
    { new: true, runValidators: true }
  ).lean();
  if (!incident) {
    // Distinguish "full" from "not yours / doesn't exist".
    const exists = await Incident.findOne({ _id: id, userId }).select("_id").lean();
    if (exists) {
      res.status(400).json({ message: `An incident can have at most ${MAX_UPDATES_PER_INCIDENT} updates.` });
      return;
    }
    notFound(res);
    return;
  }
  res.json(await serializeOne(incident));
};

// GET /incidents/export.csv
export const exportIncidents = async (req: Request, res: Response) => {
  const incidents = await Incident.find({ userId: req.userId! })
    .sort({ startedAt: -1 })
    .limit(MAX_EXPORT_ROWS)
    .lean();
  const monitors = await monitorsFor(incidents);

  const csv = toCsv(
    [
      "id",
      "monitor",
      "started_at",
      "resolved_at",
      "duration_ms",
      "status",
      "acknowledged_at",
      "status_code",
      "error_type",
      "error_message",
    ],
    incidents.map((i: any) => [
      String(i._id),
      monitorDisplayName(monitors.get(String(i.websiteId))),
      new Date(i.startedAt).toISOString(),
      i.resolvedAt ? new Date(i.resolvedAt).toISOString() : "",
      i.durationMs ?? "",
      i.ongoing ? (i.acknowledgedAt ? "acknowledged" : "open") : "resolved",
      i.acknowledgedAt ? new Date(i.acknowledgedAt).toISOString() : "",
      i.lastStatusCode ?? "",
      i.errorType ?? "",
      i.errorMessage ?? "",
    ])
  );
  sendCsv(res, "incidents.csv", csv);
};

import { beforeEach, describe, expect, it } from "vitest";
import { GET as getVehicle, PATCH as patchVehicle, DELETE as deleteVehicle } from "@/app/api/vehicles/[id]/route";
import { GET as listVehicles, POST as createVehicleRoute } from "@/app/api/vehicles/route";
import { POST as createEvent } from "@/app/api/vehicles/[id]/events/route";
import { PATCH as patchEvent, DELETE as deleteEvent } from "@/app/api/vehicles/[id]/events/[eventId]/route";
import {
  vehicleDetailResponseWireSchema,
  vehicleListWireSchema,
  vehicleSummaryResponseWireSchema,
} from "@/lib/contracts/response-schemas";
import { actAs, call, createUser, createVehicle, db, expectSchema, resetState } from "../support/harness";

describe("vehicles (real Postgres)", () => {
  beforeEach(resetState);

  it("creates a vehicle with a CREATED timeline event and returns the strict wire shape", async () => {
    const owner = await createUser();
    actAs(owner);

    const created = await call(createVehicleRoute, {
      json: { uniqueIdentifier: "IT-100", licensePlate: "CAB-1234", manufacturer: "Toyota", model: "Corolla", year: 1998 },
    });
    expect(created.status).toBe(201);
    expectSchema(vehicleSummaryResponseWireSchema, created.body);

    const detail = await call(getVehicle, { params: { id: created.body.vehicle.id } });
    const parsed = expectSchema(vehicleDetailResponseWireSchema, detail.body);
    expect(parsed.vehicle.events.map((e) => e.type)).toEqual(["CREATED"]);
  });

  it("rejects unauthenticated creation and duplicate identifiers/plates", async () => {
    const owner = await createUser();
    expect((await call(createVehicleRoute, { json: { uniqueIdentifier: "IT-1", manufacturer: "A", model: "B", year: 1990 } })).status).toBe(401);

    actAs(owner);
    const body = { uniqueIdentifier: "IT-DUP", licensePlate: "DUP-1", manufacturer: "Ford", model: "Anglia", year: 1962 };
    expect((await call(createVehicleRoute, { json: body })).status).toBe(201);
    expect((await call(createVehicleRoute, { json: body })).status).toBe(409);
    expect((await call(createVehicleRoute, { json: { ...body, uniqueIdentifier: "IT-OTHER" } })).status).toBe(409);
    expect(await db.vehicle.count({ where: { uniqueIdentifier: "IT-DUP" } })).toBe(1);
  });

  it("lists only public vehicles with filtering and pagination", async () => {
    const owner = await createUser();
    for (let i = 0; i < 5; i += 1) await createVehicle(owner, { uniqueIdentifier: `IT-PUB-${i}`, manufacturer: i < 3 ? "Morris" : "Ford" });
    await createVehicle(owner, { uniqueIdentifier: "IT-PRIVATE", visibility: "PRIVATE" });

    const all = await call(listVehicles, { query: { pageSize: 50 } });
    const parsed = expectSchema(vehicleListWireSchema, all.body);
    expect(parsed.pagination.total).toBe(5);
    expect(parsed.items.some((v) => v.uniqueIdentifier === "IT-PRIVATE")).toBe(false);

    const page2 = await call(listVehicles, { query: { pageSize: 2, page: 2 } });
    expect(page2.body.items).toHaveLength(2);
    expect(page2.body.pagination).toMatchObject({ page: 2, pageSize: 2, total: 5, totalPages: 3 });

    const morris = await call(listVehicles, { query: { manufacturer: "morr" } });
    expect(morris.body.pagination.total).toBe(3);

    const bySearch = await call(listVehicles, { query: { search: "pub-4" } });
    expect(bySearch.body.items.map((v: { uniqueIdentifier: string }) => v.uniqueIdentifier)).toEqual(["IT-PUB-4"]);

    expect((await call(listVehicles, { query: { year: "abc" } })).status).toBe(400);
  });

  it("enforces private visibility: owner, moderator and admin see it; others get 404", async () => {
    const owner = await createUser();
    const stranger = await createUser();
    const moderator = await createUser("MODERATOR");
    const admin = await createUser("ADMIN");
    const vehicle = await createVehicle(owner, { visibility: "PRIVATE" });

    const status = async (who: { id: string } | null) => {
      actAs(who);
      return (await call(getVehicle, { params: { id: vehicle.id } })).status;
    };

    expect(await status(null)).toBe(404);
    expect(await status(stranger)).toBe(404);
    expect(await status(owner)).toBe(200);
    expect(await status(moderator)).toBe(200);
    expect(await status(admin)).toBe(200);
  });

  it("allows owner/moderator to update, blocks strangers, and maps duplicate plates to 409", async () => {
    const owner = await createUser();
    const stranger = await createUser();
    const moderator = await createUser("MODERATOR");
    const vehicle = await createVehicle(owner, { licensePlate: "PLATE-1" });
    await createVehicle(owner, { licensePlate: "PLATE-2" });

    actAs(stranger);
    expect((await call(patchVehicle, { method: "PATCH", json: { description: "hax" }, params: { id: vehicle.id } })).status).toBe(403);

    actAs(owner);
    const updated = await call(patchVehicle, { method: "PATCH", json: { description: "Restored", visibility: "PRIVATE" }, params: { id: vehicle.id } });
    expect(updated.status).toBe(200);
    expect(updated.body.vehicle).toMatchObject({ description: "Restored", visibility: "PRIVATE" });

    const conflict = await call(patchVehicle, { method: "PATCH", json: { licensePlate: "PLATE-2" }, params: { id: vehicle.id } });
    expect(conflict.status).toBe(409);

    actAs(moderator);
    expect((await call(patchVehicle, { method: "PATCH", json: { model: "Moderated" }, params: { id: vehicle.id } })).status).toBe(200);
  });

  it("deletes a vehicle and cascades events and photos", async () => {
    const owner = await createUser();
    const stranger = await createUser();
    const vehicle = await createVehicle(owner);
    await db.vehicleEvent.create({ data: { vehicleId: vehicle.id, userId: owner.id, type: "NOTE", title: "note" } });

    actAs(stranger);
    expect((await call(deleteVehicle, { method: "DELETE", params: { id: vehicle.id } })).status).toBe(403);

    actAs(owner);
    expect((await call(deleteVehicle, { method: "DELETE", params: { id: vehicle.id } })).status).toBe(204);
    expect(await db.vehicle.count()).toBe(0);
    expect(await db.vehicleEvent.count()).toBe(0);
  });

  it("manages timeline events with permissions and orders them by occurredAt", async () => {
    const owner = await createUser();
    const stranger = await createUser();
    const vehicle = await createVehicle(owner);
    const params = { id: vehicle.id };

    actAs(stranger);
    expect((await call(createEvent, { json: { type: "NOTE", title: "Intruder" }, params })).status).toBe(403);

    actAs(owner);
    await call(createEvent, { json: { type: "NOTE", title: "Undated" }, params });
    await call(createEvent, { json: { type: "SERVICE", title: "Old", occurredAt: "1975-05-05T10:00:00.000Z", sourceUrl: "https://example.com/doc" }, params });
    const recent = await call(createEvent, { json: { type: "INSPECTION", title: "Recent", occurredAt: "2024-02-02T10:00:00.000Z" }, params });
    expect(recent.status).toBe(201);
    expect((await call(createEvent, { json: { type: "NOTE", title: "Bad", sourceUrl: "javascript:alert(1)" }, params })).status).toBe(400);

    const detail = await call(getVehicle, { params });
    expect(detail.body.vehicle.events.map((e: { title: string }) => e.title)).toEqual(["Recent", "Old", "Undated"]);

    const eventParams = { id: vehicle.id, eventId: recent.body.event.id };
    const edited = await call(patchEvent, { method: "PATCH", json: { title: "Recent (edited)", details: null }, params: eventParams });
    expect(edited.status).toBe(200);
    expect(edited.body.event.title).toBe("Recent (edited)");

    // An event id from another vehicle must not be reachable through this vehicle's URL.
    const other = await createVehicle(owner);
    expect((await call(deleteEvent, { method: "DELETE", params: { id: other.id, eventId: recent.body.event.id } })).status).toBe(404);

    expect((await call(deleteEvent, { method: "DELETE", params: eventParams })).status).toBe(204);
    expect(await db.vehicleEvent.count({ where: { vehicleId: vehicle.id } })).toBe(2);
  });
});

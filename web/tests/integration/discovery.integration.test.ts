import { beforeEach, describe, expect, it } from "vitest";
import { GET as getFeed } from "@/app/api/feed/route";
import { PATCH as patchVehicle } from "@/app/api/vehicles/[id]/route";
import { GET as listVehicles, POST as createVehicle } from "@/app/api/vehicles/route";
import { vehicleListWireSchema } from "@/lib/contracts/response-schemas";
import { actAs, call, createUser, createVehicle as arrangeVehicle, db, expectSchema, resetState } from "../support/harness";

async function names(query: Record<string, string | number>) {
  const res = await call(listVehicles, { query });
  expect(res.status, JSON.stringify(res.body)).toBe(200);
  return expectSchema(vehicleListWireSchema, res.body).items.map((item) => `${item.manufacturer} ${item.model}`);
}

describe("vehicle discovery (real Postgres)", () => {
  beforeEach(resetState);

  async function seed() {
    const owner = await createUser();
    const corolla = await arrangeVehicle(owner, { manufacturer: "Toyota", model: "Corolla", year: 1998, description: "Daily driver from Kandy", attributes: { color: "Red", fuelType: "PETROL", transmission: "MANUAL", bodyType: "SEDAN" } });
    const anglia = await arrangeVehicle(owner, { manufacturer: "Ford", model: "Anglia", year: 1962, description: "Restored with a Corolla-era gearbox", attributes: { color: "Dark red", fuelType: "PETROL", transmission: "MANUAL" } });
    const leaf = await arrangeVehicle(owner, { manufacturer: "Nissan", model: "Leaf", year: 2019, attributes: { fuelType: "ELECTRIC", transmission: "AUTOMATIC", bodyType: "HATCHBACK" } });
    return { owner, corolla, anglia, leaf };
  }

  it("searches full text with partial words, descriptions and timeline text, and ranks by relevance", async () => {
    const { owner, corolla, anglia, leaf } = await seed();
    await db.vehicleEvent.create({ data: { vehicleId: leaf.id, userId: owner.id, type: "SERVICE", title: "Battery replaced at Colombo garage" } });

    expect(await names({ q: "Corolla" })).toEqual(expect.arrayContaining(["Toyota Corolla", "Ford Anglia"]));
    // Model match ranks above a description-only mention.
    expect((await names({ q: "Corolla" }))[0]).toBe("Toyota Corolla");
    // Partial words and case-insensitivity.
    expect(await names({ q: "coro" })).toContain("Toyota Corolla");
    // Description text and timeline text.
    expect(await names({ q: "Kandy" })).toEqual(["Toyota Corolla"]);
    expect(await names({ q: "battery colombo" })).toEqual(["Nissan Leaf"]);
    // Nothing matches; LIKE wildcards are treated literally.
    expect(await names({ q: "zzzz" })).toEqual([]);
    expect(await names({ q: "%%" })).toEqual([]);
    expect(corolla.id && anglia.id).toBeTruthy();
  });

  it("never searches private, hidden or deleted vehicles", async () => {
    const owner = await createUser();
    await arrangeVehicle(owner, { manufacturer: "Secret", model: "Private", visibility: "PRIVATE" });
    await arrangeVehicle(owner, { manufacturer: "Secret", model: "Hidden", hiddenAt: new Date() });
    await arrangeVehicle(owner, { manufacturer: "Secret", model: "Deleted", deletedAt: new Date(), deletedById: owner.id });
    await arrangeVehicle(owner, { manufacturer: "Secret", model: "Visible" });
    expect(await names({ q: "Secret" })).toEqual(["Secret Visible"]);
  });

  it("sorts and filters by year range", async () => {
    await seed();
    expect(await names({ sort: "year_asc" })).toEqual(["Ford Anglia", "Toyota Corolla", "Nissan Leaf"]);
    expect(await names({ sort: "year_desc" })).toEqual(["Nissan Leaf", "Toyota Corolla", "Ford Anglia"]);
    expect(await names({ sort: "name" })).toEqual(["Ford Anglia", "Nissan Leaf", "Toyota Corolla"]);
    expect(await names({ yearFrom: 1990 })).toEqual(expect.arrayContaining(["Toyota Corolla", "Nissan Leaf"]));
    expect(await names({ yearFrom: 1990 })).toHaveLength(2);
    expect(await names({ yearFrom: 1950, yearTo: 1999, sort: "year_asc" })).toEqual(["Ford Anglia", "Toyota Corolla"]);
    expect((await call(listVehicles, { query: { yearFrom: 2000, yearTo: 1990 } })).status).toBe(400);
    expect((await call(listVehicles, { query: { sort: "bogus" } })).status).toBe(400);
    // Filters compose with search, and pagination reports totals.
    expect(await names({ q: "Corolla", yearFrom: 1990 })).toEqual(["Toyota Corolla"]);
    const paged = await call(listVehicles, { query: { sort: "year_asc", pageSize: 2, page: 2 } });
    expect(paged.body.pagination).toMatchObject({ page: 2, total: 3, totalPages: 2 });
    expect(paged.body.items).toHaveLength(1);
  });

  it("filters on structured attributes", async () => {
    await seed();
    expect(await names({ fuelType: "ELECTRIC" })).toEqual(["Nissan Leaf"]);
    expect((await names({ transmission: "MANUAL" })).sort()).toEqual(["Ford Anglia", "Toyota Corolla"]);
    expect((await names({ color: "red" })).sort()).toEqual(["Ford Anglia", "Toyota Corolla"]);
    expect(await names({ color: "dark", fuelType: "PETROL" })).toEqual(["Ford Anglia"]);
    expect(await names({ bodyType: "HATCHBACK", fuelType: "ELECTRIC" })).toEqual(["Nissan Leaf"]);
    expect(await names({ bodyType: "SUV" })).toEqual([]);
    expect((await call(listVehicles, { query: { fuelType: "STEAM" } })).status).toBe(400);
  });

  it("stores validated attributes on create and update, and clears them with null", async () => {
    const owner = await createUser();
    actAs(owner);
    const base = { uniqueIdentifier: "ATTR-1", manufacturer: "Morris", model: "Minor", year: 1955 };

    expect((await call(createVehicle, { json: { ...base, attributes: { fuelType: "STEAM" } } })).status).toBe(400);
    expect((await call(createVehicle, { json: { ...base, attributes: { colour: "red" } } })).status).toBe(400);

    const created = await call(createVehicle, { json: { ...base, attributes: { color: "Black", engineCc: 803, fuelType: "PETROL" } } });
    expect(created.status).toBe(201);
    const params = { id: created.body.vehicle.id as string };
    expect(created.body.vehicle.attributes).toEqual({ color: "Black", engineCc: 803, fuelType: "PETROL" });

    const updated = await call(patchVehicle, { method: "PATCH", json: { attributes: { color: "Green", odometerKm: 90000 } }, params });
    expect(updated.body.vehicle.attributes).toEqual({ color: "Green", odometerKm: 90000 });

    const cleared = await call(patchVehicle, { method: "PATCH", json: { attributes: null }, params });
    expect(cleared.status).toBe(200);
    expect(cleared.body.vehicle.attributes).toBeNull();
  });
});

describe("follow feed (real Postgres)", () => {
  beforeEach(resetState);

  it("requires a session and is empty until the user follows someone", async () => {
    expect((await call(getFeed)).status).toBe(401);
    const me = await createUser();
    actAs(me);
    const empty = await call(getFeed);
    expect(empty.status).toBe(200);
    expect(empty.body).toMatchObject({ items: [], followingCount: 0, pagination: { total: 0 } });
  });

  it("shows public activity from followed users only, newest first", async () => {
    const me = await createUser();
    const friend = await createUser("USER", "Friend");
    const stranger = await createUser();
    await db.follow.create({ data: { followerId: me.id, followeeId: friend.id } });

    const vehicle = await arrangeVehicle(friend, { manufacturer: "Austin", model: "Seven" });
    const privateVehicle = await arrangeVehicle(friend, { visibility: "PRIVATE" });
    const strangerVehicle = await arrangeVehicle(stranger);
    const t = (minutes: number) => new Date(Date.now() - minutes * 60_000);

    await db.vehicle.update({ where: { id: vehicle.id }, data: { createdAt: t(30) } });
    await db.vehicleEvent.create({ data: { vehicleId: vehicle.id, userId: friend.id, type: "SERVICE", title: "Oil change", createdAt: t(20) } });
    await db.vehicleEvent.create({ data: { vehicleId: vehicle.id, userId: friend.id, type: "CREATED", title: "Vehicle entry created", createdAt: t(25) } });
    await db.vehicleEvent.create({ data: { vehicleId: vehicle.id, userId: friend.id, type: "NOTE", title: "Hidden note", hiddenAt: new Date(), createdAt: t(15) } });
    await db.vehicleEvent.create({ data: { vehicleId: privateVehicle.id, userId: friend.id, type: "NOTE", title: "Private note", createdAt: t(10) } });
    await db.vehicleEvent.create({ data: { vehicleId: strangerVehicle.id, userId: stranger.id, type: "NOTE", title: "Stranger note", createdAt: t(5) } });
    await db.vehiclePhoto.create({ data: { vehicleId: vehicle.id, userId: friend.id, storageKey: `vehicles/${vehicle.id}/a.png`, url: "http://localhost/a.png", createdAt: t(1) } });

    actAs(me);
    const feed = await call(getFeed);
    expect(feed.status).toBe(200);
    expect(feed.body.followingCount).toBe(1);
    expect(feed.body.items.map((i: { kind: string }) => i.kind)).toEqual(["PHOTO", "EVENT", "VEHICLE"]);
    expect(feed.body.items[1]).toMatchObject({ title: "Oil change", actor: { id: friend.id, name: "Friend" } });
    expect(feed.body.pagination.total).toBe(3);

    // Pagination slices the merged stream.
    const second = await call(getFeed, { query: { pageSize: 2, page: 2 } });
    expect(second.body.items.map((i: { kind: string }) => i.kind)).toEqual(["VEHICLE"]);
    expect((await call(getFeed, { query: { pageSize: 500 } })).status).toBe(400);

    // Banned authors disappear from the feed.
    await db.user.update({ where: { id: friend.id }, data: { bannedAt: new Date() } });
    expect((await call(getFeed)).body.items).toEqual([]);
  });
});

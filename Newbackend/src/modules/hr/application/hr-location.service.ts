import { Injectable } from "@nestjs/common";
import { InjectModel } from "../../../database/orm-nest";
import type { Model } from "../../../database/orm";
import type { AuthenticatedUser } from "../../../common/decorators/current-user.decorator";
import {
  isLocationScopedUser,
  withLocation,
  areaLabelForCity,
  placeTermsForCity,
  type LocationScope,
} from "../../../common/auth/location-scope";

/** Stay address fields an office area is matched against. */
export const STAY_LOCATION_FIELDS = ["address.city", "address.district", "address.street"];

/**
 * Works out an HR login's location from the HR office it is assigned to (the
 * primary office of the employee profile linked to the login). Read fresh on
 * every request, so changing or removing the office takes effect at once.
 *
 * Returns null for every other role (no location restriction). An HR login
 * without an active profile, or whose office is inactive or has no city,
 * gets a scope with no place names: it sees nothing until an office is set.
 */
@Injectable()
export class HrLocationService {
  constructor(
    @InjectModel("HrEmployee") private readonly employees: Model<any>,
    @InjectModel("HrOffice") private readonly offices: Model<any>,
    @InjectModel("Ashram") private readonly ashrams: Model<any>,
  ) {}

  /**
   * Stays whose address is in the login's office area, whatever their status
   * (pending stays included, so the area's new listings can be reviewed).
   * null for logins that are not location-scoped.
   */
  async stayIdsInArea(user: AuthenticatedUser | undefined | null): Promise<string[] | null> {
    const scope = await this.scopeFor(user);
    if (scope === null) return null;
    const rows = (await this.ashrams
      .find(withLocation({ deletedAt: null }, scope, STAY_LOCATION_FIELDS))
      .select("_id")
      .lean()) as any[];
    return rows.map((row) => String(row._id));
  }

  async scopeFor(user: AuthenticatedUser | undefined | null): Promise<LocationScope> {
    if (!isLocationScopedUser(user)) return null;
    const employee = (await this.employees
      .findOne({ userId: user!.id, status: "active" })
      .select("primaryOfficeId")
      .lean()) as any;
    const office = employee?.primaryOfficeId
      ? ((await this.offices.findOne({ _id: employee.primaryOfficeId, active: true }).select("name city").lean()) as any)
      : null;
    return {
      city: office?.city ?? "",
      officeName: office?.name ?? "",
      area: office ? areaLabelForCity(office.city) : "",
      terms: office ? placeTermsForCity(office.city) : [],
    };
  }
}

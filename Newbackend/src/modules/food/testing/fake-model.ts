let counter = 0;
export const newId = () => `id_${++counter}`;

/** Minimal in-memory stand-in for the ORM model, enough for the food services. */
export function fakeModel(initial: any[] = []) {
  const rows: any[] = initial.map((r) => ({ _id: newId(), ...r }));

  const matches = (row: any, filter: any = {}): boolean =>
    Object.entries(filter).every(([key, val]: [string, any]) => {
      if (key === "$or") return val.some((f: any) => matches(row, f));
      if (val && typeof val === "object" && !(val instanceof Date)) {
        if ("$in" in val) return val.$in.map(String).includes(String(row[key]));
        if ("$ne" in val) return String(row[key]) !== String(val.$ne);
        if ("$regex" in val)
          return new RegExp(val.$regex, val.$options).test(String(row[key] ?? ""));
        if ("$gte" in val || "$lte" in val || "$gt" in val || "$lt" in val) {
          const v = new Date(row[key]).getTime();
          if ("$gte" in val && v < new Date(val.$gte).getTime()) return false;
          if ("$lte" in val && v > new Date(val.$lte).getTime()) return false;
          if ("$gt" in val && v <= new Date(val.$gt).getTime()) return false;
          if ("$lt" in val && v >= new Date(val.$lt).getTime()) return false;
          return true;
        }
      }
      return String(row[key]) === String(val);
    });

  const wrap = (row: any) => {
    if (!row) return null;
    return Object.assign(row, {
      set(k: string, v: unknown) {
        row[k] = v;
      },
      async save() {
        return row;
      },
      toObject() {
        const plain = { ...row };
        delete plain.set;
        delete plain.save;
        delete plain.toObject;
        return plain;
      },
    });
  };

  const query = (list: any[]) => {
    let result = list;
    const q: any = {
      select: () => q,
      populate: () => q,
      limit: (n: number) => {
        result = result.slice(0, n);
        return q;
      },
      sort: (spec: Record<string, 1 | -1>) => {
        const [[key, dir]] = Object.entries(spec ?? { _id: 1 });
        // Rows created in the same millisecond keep their insertion order (reversed for a descending sort).
        const position = (row: any) => list.indexOf(row);
        result = [...result].sort((a, b) =>
          a[key] > b[key] ? dir : a[key] < b[key] ? -dir : dir * (position(a) - position(b)),
        );
        return q;
      },
      lean: () => Promise.resolve(result.map((r) => wrap(r)?.toObject())),
      then: (res: any, rej?: any) => Promise.resolve(result.map(wrap)).then(res, rej),
    };
    return q;
  };

  return {
    rows,
    find: (f?: any) => query(rows.filter((r) => matches(r, f))),
    findOne: (f?: any) => {
      const row = rows.find((r) => matches(r, f));
      const q: any = {
        select: () => q,
        lean: () => Promise.resolve(row ? wrap(row)?.toObject() : null),
        then: (res: any, rej?: any) => Promise.resolve(wrap(row)).then(res, rej),
      };
      return q;
    },
    countDocuments: async (f?: any) => rows.filter((r) => matches(r, f)).length,
    findById: async (id: any) => wrap(rows.find((r) => String(r._id) === String(id))),
    findOneAndUpdate: async (f: any, update: any) => {
      const row = rows.find((r) => matches(r, f));
      if (!row) return null;
      Object.assign(row, update.$set ?? update, { updatedAt: new Date() });
      return wrap(row);
    },
    findByIdAndUpdate: async (id: any, update: any) => {
      const row = rows.find((r) => String(r._id) === String(id));
      if (!row) return null;
      Object.assign(row, update.$set ?? update, { updatedAt: new Date() });
      return wrap(row);
    },
    updateOne: async (f: any, update: any) => {
      const row = rows.find((r) => matches(r, f));
      if (row) Object.assign(row, update.$set ?? update, { updatedAt: new Date() });
      return { modifiedCount: row ? 1 : 0 };
    },
    exists: async (f?: any) => (rows.some((r) => matches(r, f)) ? { _id: 1 } : null),
    create: async (data: any) => {
      const now = new Date();
      const row = { _id: newId(), createdAt: now, updatedAt: now, ...data };
      rows.push(row);
      return wrap(row);
    },
    deleteOne: async (f: any) => {
      const i = rows.findIndex((r) => matches(r, f));
      if (i >= 0) rows.splice(i, 1);
      return { deletedCount: i >= 0 ? 1 : 0 };
    },
  };
}

/** Reversible stand-in for BankAccountCrypto. */
export const fakeCrypto = {
  encrypt: (value: string) => ({ ciphertext: `x:${value}`, iv: "iv", tag: "tag" }),
  decrypt: (e: { ciphertext: string }) => e.ciphertext.slice(2),
} as any;

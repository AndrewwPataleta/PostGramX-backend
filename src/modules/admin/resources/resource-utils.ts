
import { ILike } from 'typeorm';


const NANO_IN_TON = 1_000_000_000n;
const loadAdminJs = () => import('adminjs');
type BaseRecord = {
  params: Record<string, any>;
};

export const formatNanoToTon = (
  value: string | number | null | undefined,
): string | null => {
  if (value === null || value === undefined) {
    return null;
  }

  const raw = typeof value === 'number' ? value.toString() : value;
  if (!raw) {
    return null;
  }

  try {
    const nano = BigInt(raw);
    const integer = nano / NANO_IN_TON;
    const fraction = nano % NANO_IN_TON;
    if (fraction === 0n) {
      return integer.toString();
    }
    const fractionString = fraction
      .toString()
      .padStart(9, '0')
      .replace(/0+$/, '');
    return `${integer.toString()}.${fractionString}`;
  } catch (error) {
    return raw.toString();
  }
};

export const applyNanoToTon = (
  record: BaseRecord,
  sourceKey: string,
  targetKey: string,
) => {
  const sourceValue = record?.params?.[sourceKey];
  record.params[targetKey] = formatNanoToTon(sourceValue);
};

export const applyNanoToTonForRecords = (
  records: BaseRecord[],
  sourceKey: string,
  targetKey: string,
) => {
  if (!records) {
    return;
  }

  records.forEach((record) => applyNanoToTon(record, sourceKey, targetKey));
};

export const buildListActionWithSearch = (searchColumns: string[]) => ({
  handler: async (request: any, response: any, context: any) => {
    const { BaseRecord, Filter, ListAction, flat, populator } =
      await loadAdminJs();
    const { query } = request;
    const { filters = {}, sortBy, direction } = flat.unflatten(
      query || {},
    ) as any;
    const qValue =
      typeof filters.q === 'string' ? filters.q.trim() : undefined;

    if (!qValue) {
      const listHandler = Array.isArray(ListAction.handler)
        ? ListAction.handler[0]
        : ListAction.handler;
      return listHandler(request, response, context);
    }

    const { resource, _admin, currentAdmin } = context;
    let { page, perPage } = flat.unflatten(query || {}) as any;
    if (perPage) {
      perPage = Math.min(Number(perPage), 500);
    } else {
      perPage = _admin.options.settings?.defaultPerPage ?? 10;
    }
    page = Number(page) || 1;

    const listProperties = resource.decorate().getListProperties();
    const firstProperty = listProperties.find((property) =>
      property.isSortable(),
    );
    const resourceSort = resource.decorate().options.sort || {};
    const sortField =
      sortBy || resourceSort.sortBy || firstProperty?.name() || 'id';
    const sortDirection =
      (direction || resourceSort.direction || 'asc') === 'asc' ? 'ASC' : 'DESC';

    const normalizedFilters = { ...filters };
    delete normalizedFilters.q;

    const filter = await new Filter(normalizedFilters, resource).populate(
      context,
    );

    const like = `%${qValue}%`;
    const searchConditions = searchColumns.map((column) => ({

      [column]: ILike(like),
    }));

    const repository = (resource as any).model.getRepository();
    const [instances, total] = await repository.findAndCount({
      where: searchConditions,
      take: perPage,
      skip: (page - 1) * perPage,
      order: sortField ? { [sortField]: sortDirection } : undefined,
    });

    const records = instances.map(
      (instance: Record<string, unknown>) => new BaseRecord(instance, resource),
    );
    const populatedRecords = await populator(records, context);

    return {
      meta: {
        total,
        perPage,
        page,
        direction: sortDirection.toLowerCase(),
        sortBy: sortField,
      },
      records: populatedRecords.map((record) => record.toJSON(currentAdmin)),
    };
  },
});

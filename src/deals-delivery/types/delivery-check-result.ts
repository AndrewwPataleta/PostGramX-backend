export type DeliveryCheckResult =
    | {ok: true}
    | {ok: false; reason: string; details?: string};

import { channelsResource } from './channels.resource';
import { dealsResource } from './deals.resource';
import { transactionsResource } from './transactions.resource';
import { usersResource } from './users.resource';

export const adminResources = [
  usersResource,
  channelsResource,
  dealsResource,
  transactionsResource,
];

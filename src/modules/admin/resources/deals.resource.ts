import { DealEntity } from '../../deals/entities/deal.entity';
import { DealEscrowStatus } from '../../deals/types/deal-escrow-status.enum';
import { DealStatus } from '../../deals/types/deal-status.enum';
import { ResourceOptions } from '../types/admin.types';
import { applyNanoToTon, applyNanoToTonForRecords } from './resource-utils';

const options: ResourceOptions = {
  navigation: { name: 'PostgramX', icon: 'Archive' },
  listProperties: [
    'id',
    'status',
    'escrowStatus',
    'advertiserUserId',
    'publisherOwnerUserId',
    'channelId',
    'listingId',
    'escrowAmountTon',
    'escrowCurrency',
    'escrowExpiresAt',
    'scheduledAt',
    'lastActivityAt',
    'createdAt',
  ],
  showProperties: [
    'id',
    'status',
    'escrowStatus',
    'sideInitiator',
    'advertiserUserId',
    'publisherOwnerUserId',
    'createdByUserId',
    'channelId',
    'listingId',
    'escrowAmountTon',
    'escrowAmountNano',
    'escrowCurrency',
    'escrowWalletId',
    'escrowExpiresAt',
    'scheduledAt',
    'stalledAt',
    'lastActivityAt',
    'brief',
    'cancelReason',
    'offerSnapshot',
    'listingSnapshot',
    'createdAt',
    'updatedAt',
  ],
  editProperties: [
    'status',
    'escrowStatus',
    'scheduledAt',
    'escrowExpiresAt',
    'cancelReason',
  ],
  filterProperties: [
    'id',
    'status',
    'escrowStatus',
    'advertiserUserId',
    'publisherOwnerUserId',
    'channelId',
    'listingId',
    'createdAt',
    'lastActivityAt',
    'scheduledAt',
    'escrowExpiresAt',
  ],
  properties: {
    id: { isDisabled: true },
    advertiserUserId: { isDisabled: true, reference: 'User' },
    publisherOwnerUserId: { isDisabled: true, reference: 'User' },
    createdByUserId: { isDisabled: true, reference: 'User' },
    channelId: { isDisabled: true, reference: 'ChannelEntity' },
    listingId: { isDisabled: true },
    escrowWalletId: { isDisabled: true },
    escrowAmountNano: { isDisabled: true },
    escrowCurrency: { isDisabled: true },
    offerSnapshot: { isVisible: { list: false, edit: false, filter: false } },
    listingSnapshot: { isVisible: { list: false, edit: false, filter: false } },
    escrowAmountTon: {
      isVisible: { list: true, show: true, edit: false, filter: false },
      label: 'Escrow (TON)',
      isSortable: false,
    },
  },
  actions: {
    list: {
      after: async (response: any) => {
        if (response?.records) {
          applyNanoToTonForRecords(
            response.records,
            'escrowAmountNano',
            'escrowAmountTon',
          );
        }
        return response;
      },
    },
    show: {
      after: async (response: any) => {
        if (response?.record) {
          applyNanoToTon(
            response.record,
            'escrowAmountNano',
            'escrowAmountTon',
          );
        }
        return response;
      },
    },
    delete: {
      guard:
        'This will permanently delete the deal and any linked records. This action cannot be undone.',
    },
    bulkDelete: {
      guard:
        'This will permanently delete the selected deals. This action cannot be undone.',
    },
    forceCancel: {
      actionType: 'record',
      icon: 'Close',
      guard:
        'This will force-cancel the deal and mark escrow as canceled. Continue?',
      handler: async (request: any, response: any, context: any) => {
        const { record, resource, currentAdmin } = context;
        if (!record) {
          throw new Error('Deal record not found.');
        }

        await resource.update(record.id(), {
          status: DealStatus.CANCELED,
          escrowStatus: DealEscrowStatus.CANCELED,
          cancelReason: 'ADMIN_FORCE_CANCEL',
        });
        const updatedRecord = await resource.findOne(record.id());

        return {
          record: updatedRecord?.toJSON(currentAdmin),
          notice: {
            message: 'Deal force-canceled.',
            type: 'success',
          },
        };
      },
    },
  },
  sort: {
    sortBy: 'createdAt',
    direction: 'desc',
  },
};

export const dealsResource = {
  resource: DealEntity,
  options,
};

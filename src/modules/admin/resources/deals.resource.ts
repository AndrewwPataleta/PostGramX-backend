import {DealEntity} from '../../deals/entities/deal.entity';
import {DealStatus} from '../../../common/constants/deals/deal-status.constants';
import {DealStage} from '../../../common/constants/deals/deal-stage.constants';
import {ResourceOptions} from '../types/admin.types';

const options: ResourceOptions = {
    navigation: {name: 'PostgramX', icon: 'Archive'},
    listProperties: [
        'id',
        'status',
        'stage',
        'advertiserUserId',
        'channelId',
        'listingId',
        'scheduledAt',
        'lastActivityAt',
        'createdAt',
    ],
    showProperties: [
        'id',
        'status',
        'stage',
        'advertiserUserId',
        'createdByUserId',
        'channelId',
        'listingId',
        'scheduledAt',
        'lastActivityAt',
        'cancelReason',
        'listingSnapshot',
        'createdAt',
        'updatedAt',
    ],
    editProperties: ['status', 'stage', 'scheduledAt', 'cancelReason'],
    filterProperties: [
        'id',
        'status',
        'stage',
        'advertiserUserId',
        'channelId',
        'listingId',
        'createdAt',
        'lastActivityAt',
        'scheduledAt',
    ],
    properties: {
        id: {isDisabled: true},
        advertiserUserId: {isDisabled: true, reference: 'User'},
        createdByUserId: {isDisabled: true, reference: 'User'},
        channelId: {isDisabled: true, reference: 'ChannelEntity'},
        listingId: {isDisabled: true},
        listingSnapshot: {isVisible: {list: false, edit: false, filter: false}},
    },
    actions: {
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
                'This will force-cancel the deal and mark as finalized. Continue?',
            handler: async (request: any, response: any, context: any) => {
                const {record, resource, currentAdmin} = context;
                if (!record) {
                    throw new Error('Deal record not found.');
                }

                await resource.update(record.id(), {
                    status: DealStatus.CANCELED,
                    stage: DealStage.FINALIZED,
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

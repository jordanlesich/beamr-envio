export const _receiptKey = {
  tip_start: ({
    senderFID,
    receiverFID,
  }: {
    senderFID: number;
    receiverFID: number;
  }) => `tip_start_${senderFID}_${receiverFID}`,

  tip_like: ({
    senderFID,
    receiverFID,
    castHash,
  }: {
    senderFID: number;
    receiverFID: number;
    castHash: string;
  }) => `tip_like_${senderFID}_${receiverFID}_${castHash}`,

  tip_recast: ({
    senderFID,
    receiverFID,
    castHash,
  }: {
    senderFID: number;
    receiverFID: number;
    castHash: string;
  }) => `tip_recast_${senderFID}_${receiverFID}_${castHash}`,

  tip_follow: ({
    senderFID,
    receiverFID,
  }: {
    senderFID: number;
    receiverFID: number;
  }) => `tip_follow_${senderFID}_${receiverFID}`,

  tip_comment: ({
    senderFID,
    receiverFID,
    castHash,
  }: {
    senderFID: number;
    receiverFID: number;
    castHash: string;
  }) => `tip_comment_${senderFID}_${receiverFID}_${castHash}`,
};

export const decodeReceiptKey = (
  receiptType: 'start' | 'like' | 'recast' | 'follow' | 'comment',
  receiptKey: string
) => {
  if (receiptType === 'start') {
    const [, , senderFID, receiverFID] = receiptKey.split('_');
    return {
      senderFID: Number(senderFID),
      receiverFID: Number(receiverFID),
    };
  }
  if (
    receiptType === 'like' ||
    receiptType === 'recast' ||
    receiptType === 'comment'
  ) {
    const [, , senderFID, receiverFID, castHash] = receiptKey.split('_');
    return {
      senderFID: Number(senderFID),
      receiverFID: Number(receiverFID),
      castHash,
    };
  }
  if (receiptType === 'follow') {
    const [, , senderFID, receiverFID] = receiptKey.split('_');
    return {
      senderFID: Number(senderFID),
      receiverFID: Number(receiverFID),
    };
  }

  throw new Error('Invalid receipt type');
};

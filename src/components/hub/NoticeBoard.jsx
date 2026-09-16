import React from 'react';
import NoticeBoard from '../NoticeBoard';

/**
 * HubNoticeBoard
 * Thin adapter for Hub to use the unified NoticeBoard with variant="full".
 */
const HubNoticeBoard = (props) => {
    return <NoticeBoard variant="full" {...props} />;
};

export default HubNoticeBoard;

import React from 'react';
import ConfirmModal from './ConfirmModal';

/**
 * ConfirmDialogModal — Re-exports unified ConfirmModal with showReasonInput enabled by default.
 * Provides backwards compatibility for admin components requiring reason logging.
 */
export default function ConfirmDialogModal(props) {
  return <ConfirmModal showReasonInput={props.showReasonInput ?? true} {...props} />;
}

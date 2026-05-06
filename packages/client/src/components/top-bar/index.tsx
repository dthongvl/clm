/* eslint-disable react-refresh/only-export-components */
import { Root } from "./root"
import { PRInfo } from "./pr-info"
import { Actions } from "./actions"
import { SubmitReviewDialog } from "./submit-review-dialog"

export const TopBar = { Root, PRInfo, Actions, SubmitReviewDialog }
export { TopBarContainer } from "./top-bar-container"
export type { TopBarRootProps } from "./root"
export type { TopBarPRInfoProps } from "./pr-info"
export type { TopBarActionsProps } from "./actions"
export type { SubmitReviewDialogProps } from "./submit-review-dialog"

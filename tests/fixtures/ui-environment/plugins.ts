// Canonical platform.ts has lazy plugin imports outside this fixture's scope.
// Fail visibly if a test unexpectedly attempts an external native operation.
const unexpectedNativeOperation = () => { throw new Error("Native operation is outside the UI environment fixture"); };
export const Browser = { open: unexpectedNativeOperation, close: unexpectedNativeOperation };
export const AppLauncher = { openUrl: unexpectedNativeOperation, canOpenUrl: unexpectedNativeOperation };

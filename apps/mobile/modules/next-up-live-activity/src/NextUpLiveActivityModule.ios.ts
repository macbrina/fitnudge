import { EventEmitter, requireNativeModule } from "expo-modules-core";

const NativeModule = requireNativeModule("NextUpLiveActivity");
export const emitter: InstanceType<typeof EventEmitter> = new EventEmitter(NativeModule);
export default NativeModule;

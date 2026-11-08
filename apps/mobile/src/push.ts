import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { api } from "./api";

Notifications.setNotificationHandler({ handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: true }) });

/** Asks permission and registers the Expo push token (APNs / FCM) with the LICENGO API. */
export async function registerForPush() {
  if (!Device.isDevice) return;
  if (Platform.OS === "android") await Notifications.setNotificationChannelAsync("default", { name: "LICENGO", importance: Notifications.AndroidImportance.DEFAULT });
  let { status } = await Notifications.getPermissionsAsync();
  if (status !== "granted") status = (await Notifications.requestPermissionsAsync()).status;
  if (status !== "granted") return;
  const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
  const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
  await api("/push-tokens", { body: { token: data, platform: Platform.OS === "ios" ? "ios" : "android" } });
}

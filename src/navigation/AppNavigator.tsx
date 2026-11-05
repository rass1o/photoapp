import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { NavigatorScreenParams } from '@react-navigation/native';
import { useNotifications } from '../context/NotificationsContext';
import SeaTabBar from '../components/SeaTabBar';

import HomeScreen from '../screens/HomeScreen';
import CameraScreen from '../screens/CameraScreen';
import RankingsScreen from '../screens/RankingsScreen';
import ShopScreen from '../screens/ShopScreen';
import ProfileScreen from '../screens/ProfileScreen';
import SubmissionDetailScreen from '../screens/SubmissionDetailScreen';
import UserProfileScreen from '../screens/UserProfileScreen';
import OctopusScreen from '../screens/OctopusScreen';
import GalleryScreen from '../screens/GalleryScreen';
import SettingsScreen from '../screens/SettingsScreen';

export type RootTabParamList = {
  Home: undefined;
  Submit: undefined;
  Rankings: undefined;
  Shop: undefined;
  Profile: undefined;
};

// Screens that can be pushed on top of the tabs from anywhere in the app
export type RootStackParamList = {
  MainTabs: NavigatorScreenParams<RootTabParamList> | undefined;
  SubmissionDetail: { submissionId: string };
  UserProfile: { userId: string };
  Octopus: undefined;
  Gallery: { userId: string; username: string };
  Settings: undefined;
};

const Tab = createBottomTabNavigator<RootTabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

function MainTabs() {
  const { unread } = useNotifications();
  return (
    <Tab.Navigator
      // A custom deep-sea bar: wavy top, glowing active tab, raised Submit
      tabBar={(props) => <SeaTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{ tabBarBadge: unread > 0 ? (unread > 9 ? '9+' : unread) : undefined }}
      />
      <Tab.Screen name="Rankings" component={RankingsScreen} />
      {/* in the middle, under the raised camera button */}
      <Tab.Screen name="Submit" component={CameraScreen} />
      <Tab.Screen name="Shop" component={ShopScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="MainTabs" component={MainTabs} options={{ headerShown: false }} />
      <Stack.Screen
        name="SubmissionDetail"
        component={SubmissionDetailScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="UserProfile"
        component={UserProfileScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Octopus"
        component={OctopusScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Gallery"
        component={GalleryScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
}
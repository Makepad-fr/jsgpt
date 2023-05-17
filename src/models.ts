interface User {
  id: string;
  name: string;
  email: string;
  image: string;
  picture: string;
  idp: string;
  iat: number;
  mfa: boolean;
  groups: string[];
  intercom_hash: string;
}

interface SessionData {
  user: User;
  expires: string;
  accessToken: string;
  authProvider: string;
}
export type Role = 'admin' | 'user';

export type PublicUser = {
  id: string;
  email: string;
  role: Role;
};


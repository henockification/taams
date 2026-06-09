export type UserProfileUpdate = {
    name: string;
};
  
  export type UpdateProfileImageRequest = {
    imageUrl: string;
};
  
  export type UpdateProfileImageResponse = {
    success: boolean;
    message: string;
    imageUrl: string;
};
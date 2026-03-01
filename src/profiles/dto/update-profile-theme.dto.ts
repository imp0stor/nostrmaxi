import { IsIn, IsOptional, IsString } from 'class-validator';

export const PROFILE_THEMES = ['dark', 'light', 'purple', 'orange', 'custom'] as const;
export type ProfileTheme = typeof PROFILE_THEMES[number];

export class UpdateProfileThemeDto {
  @IsOptional()
  @IsString()
  @IsIn(PROFILE_THEMES)
  theme?: ProfileTheme;
}

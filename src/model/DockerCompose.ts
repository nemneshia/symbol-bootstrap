/*
 * Copyright 2022 Fernando Boucquez
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * Type of a docker compose yml object for reference.
 *
 * Note this type is not complete!
 */

export interface DockerComposeService {
  build?: string;
  image?: string;
  container_name: string;
  restart?: string;
  user?: string;
  working_dir?: string;
  command?: string;
  entrypoint?: string;
  hostname?: string;
  environment?: Record<string, string>;
  stop_signal?: string;
  stop_grace_period?: string;
  volumes?: string[];
  ports?: string[];
  depends_on?: string[];
  mem_limit?: string | number;
  logging?: DockerComposeServiceLogging;
  // https://docs.docker.com/compose/compose-file/#service-configuration-reference deploy section
  networks?: {
    default: {
      ipv4_address?: string;
      aliases?: string[];
    };
  };
  // DEBUG MODE
  privileged?: boolean;
  cap_add?: string[];
  security_opt?: string[];
}

export interface DockerComposeServiceLogging {
  driver: string;
  options: Record<string, string>;
}

export interface DockerCompose {
  networks?: {
    default?: {
      ipam?: {
        config?: [
          {
            subnet: string;
          },
        ];
      };
    };
  };
  services: Record<string, DockerComposeService>;
}

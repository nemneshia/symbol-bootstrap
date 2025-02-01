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
    networks?: {
        default: {
            ipv4_address?: string;
            aliases?: string[];
        };
    };
    privileged?: boolean;
    cap_add?: string[];
    security_opt?: string[];
}
export interface DockerComposeServiceLogging {
    driver: string;
    options: Record<string, string>;
}
export interface DockerCompose {
    version: string | number;
    networks?: {
        default?: {
            ipam?: {
                config?: [
                    {
                        subnet: string;
                    }
                ];
            };
        };
    };
    services: Record<string, DockerComposeService>;
}

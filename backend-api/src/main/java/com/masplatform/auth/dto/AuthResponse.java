package com.masplatform.auth.dto;

import lombok.Builder;
import lombok.Data;

import java.util.UUID;

@Data
@Builder
public class AuthResponse {
    private String token;
    private String tokenType;
    private UUID userId;
    private String email;
    private String name;
}

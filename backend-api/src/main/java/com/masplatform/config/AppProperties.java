package com.masplatform.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
@ConfigurationProperties(prefix = "app")
@Getter
@Setter
public class AppProperties {

    private Jwt jwt = new Jwt();
    private ExecutionEngine executionEngine = new ExecutionEngine();
    private Cors cors = new Cors();
    private RateLimit rateLimit = new RateLimit();

    @Getter @Setter
    public static class Jwt {
        private String secret;
        private long expirationMs;
    }

    @Getter @Setter
    public static class ExecutionEngine {
        private String url;
        private String internalApiKey;
    }

    @Getter @Setter
    public static class Cors {
        private List<String> allowedOrigins = List.of("http://localhost:5173");
    }

    @Getter @Setter
    public static class RateLimit {
        private boolean enabled         = true;
        private int     chatPerMinute   = 10;
        private int     generalPerMinute = 100;
    }
}

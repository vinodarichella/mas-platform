package com.masplatform.health;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/health")
@RequiredArgsConstructor
public class HealthController {

    private final JdbcTemplate jdbc;

    @GetMapping
    public ResponseEntity<Map<String, Object>> health() {
        Map<String, Object> services = new LinkedHashMap<>();
        services.put("api", "ok");
        services.put("database", checkDatabase());

        boolean allOk = services.values().stream().allMatch("ok"::equals);
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("status", allOk ? "ok" : "degraded");
        body.put("services", services);

        return ResponseEntity.ok(body);
    }

    private String checkDatabase() {
        try {
            jdbc.queryForObject("SELECT 1", Integer.class);
            return "ok";
        } catch (Exception e) {
            return "unavailable";
        }
    }
}
